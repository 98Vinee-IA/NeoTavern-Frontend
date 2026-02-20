#!/bin/bash

# Chat Format Converter Script
# Converts old NeoTavern chat format to new format
#
# Usage: ./convert-chat.sh <old_file_path> <character_png_name>
#
# Example: ./convert-chat.sh "backend/data/default-user/chats/Old Folder/Old Chat.jsonl" "Character.png"

set -e

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Install with: sudo apt-get install jq  (Ubuntu/Debian)"
    echo "             brew install jq            (macOS)"
    exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <old_file_path> <character_png_name>"
    echo ""
    echo "Arguments:"
    echo "  old_file_path       Path to the old format .jsonl chat file"
    echo "  character_png_name  Character PNG filename (e.g., 'Character Name.png')"
    echo ""
    echo "Example:"
    echo "  $0 'backend/data/default-user/chats/Old Folder/Old Chat.jsonl' 'Character Name.png'"
    exit 1
fi

OLD_FILE="$1"
CHARACTER_PNG="$2"
OUTPUT_DIR="backend/data/default-user/chats"

# Check if old file exists
if [ ! -f "$OLD_FILE" ]; then
    echo "Error: Old file not found: $OLD_FILE"
    exit 1
fi

# Check if old file is .jsonl
if [[ "$OLD_FILE" != *.jsonl ]]; then
    echo "Error: Old file must be a .jsonl file"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Generate UUID for new chat file (using uuidgen or fallback to random)
if command -v uuidgen &> /dev/null; then
    NEW_UUID=$(uuidgen)
else
    NEW_UUID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())")
fi

NEW_FILE="$OUTPUT_DIR/${NEW_UUID}.jsonl"

echo "Converting chat..."
echo "  Source: $OLD_FILE"
echo "  Character: $CHARACTER_PNG"
echo "  Output: $NEW_FILE"
echo ""

# Temporary file for processing
TEMP_FILE=$(mktemp)

# Process the old format JSONL file
# Read line by line and convert
line_num=0
header_written=false
chat_name=""

while IFS= read -r line; do
    line_num=$((line_num + 1))
    
    # Skip empty lines
    [ -z "$line" ] && continue
    
    # Parse JSON with jq
    parsed=$(echo "$line" | jq -c '.' 2>/dev/null) || {
        echo "Warning: Failed to parse line $line_num, skipping"
        continue
    }
    
    # Check if this is the header line (contains user_name and character_name)
    if echo "$parsed" | jq -e '.user_name' &> /dev/null; then
        # This is the old format header
        echo "Processing header..."
        
        # Extract values from old format
        user_name=$(echo "$parsed" | jq -r '.user_name // empty')
        character_name=$(echo "$parsed" | jq -r '.character_name // empty')
        create_date=$(echo "$parsed" | jq -r '.create_date // empty')
        
        # Extract chat_metadata
        integrity=$(echo "$parsed" | jq -r '.chat_metadata.integrity // empty')
        chat_id_hash=$(echo "$parsed" | jq -r '.chat_metadata.chat_id_hash // empty')
        note_prompt=$(echo "$parsed" | jq -r '.chat_metadata.note_prompt // ""')
        note_interval=$(echo "$parsed" | jq -r '.chat_metadata.note_interval // 1')
        note_position=$(echo "$parsed" | jq -r '.chat_metadata.note_position // 1')
        note_depth=$(echo "$parsed" | jq -r '.chat_metadata.note_depth // 4')
        note_role=$(echo "$parsed" | jq -r '.chat_metadata.note_role // 0')
        persona=$(echo "$parsed" | jq -r '.chat_metadata.persona // empty')
        timed_world_info=$(echo "$parsed" | jq -c '.chat_metadata.timedWorldInfo // {}')
        variables=$(echo "$parsed" | jq -c '.chat_metadata.variables // {}')
        
        # Determine active_persona (prefer user_name, fallback to persona)
        if [ -n "$user_name" ]; then
            active_persona="$user_name"
        elif [ -n "$persona" ]; then
            active_persona="$persona"
        else
            active_persona=""
        fi
        
        # Determine chat name (use character_name or derive from filename)
        if [ -n "$character_name" ]; then
            chat_name="$character_name"
        else
            chat_name=$(basename "$OLD_FILE" .jsonl)
        fi
        
        # Build new format header
        new_header=$(jq -n -c \
            --arg integrity "$integrity" \
            --arg name "$chat_name" \
            --arg active_persona "$active_persona" \
            --argjson timedWorldInfo "$timed_world_info" \
            --argjson variables "$variables" \
            --argjson members "[\"$CHARACTER_PNG\"]" \
            '{
                chat_metadata: {
                    integrity: $integrity,
                    name: $name,
                    members: $members,
                    active_persona: ($active_persona | if . == "" then null else . end),
                    extra: {
                        timedWorldInfo: $timedWorldInfo,
                        variables: $variables
                    }
                },
                chat_lorebooks: []
            }')
        
        echo "$new_header" >> "$TEMP_FILE"
        header_written=true
        
    elif echo "$parsed" | jq -e '.name' &> /dev/null && echo "$parsed" | jq -e '.mes' &> /dev/null; then
        # This is a message line
        
        # Wait for header to be written
        if [ "$header_written" = false ]; then
            echo "Warning: Found message before header, skipping line $line_num"
            continue
        fi
        
        # Extract message fields
        name=$(echo "$parsed" | jq -r '.name // ""')
        mes=$(echo "$parsed" | jq -r '.mes // ""')
        is_user=$(echo "$parsed" | jq -r '.is_user // false')
        is_system=$(echo "$parsed" | jq -r '.is_system // false')
        send_date_old=$(echo "$parsed" | jq -r '.send_date // ""')
        force_avatar=$(echo "$parsed" | jq -r '.force_avatar // ""')
        gen_started=$(echo "$parsed" | jq -r '.gen_started // ""')
        gen_finished=$(echo "$parsed" | jq -r '.gen_finished // ""')
        swipe_id=$(echo "$parsed" | jq -r '.swipe_id // 0')
        swipes=$(echo "$parsed" | jq -c '.swipes // []')
        extra=$(echo "$parsed" | jq -c '.extra // {}')
        title=$(echo "$parsed" | jq -r '.title // ""')
        
        # Convert date format: "September 10, 2025 2:39pm" to ISO8601
        send_date_iso=$(date -d "$send_date_old" -Iseconds 2>/dev/null || echo "$send_date_old")
        
        # Extract original_avatar from force_avatar URL
        # From "/thumbnail?type=persona&file=xxx.png" extract "xxx.png"
        original_avatar=""
        if [ -n "$force_avatar" ]; then
            original_avatar=$(echo "$force_avatar" | sed -n 's/.*file=\([^&]*\).*/\1/p')
        fi
        
        # Build swipe_info from existing data
        swipe_info=$(jq -n -c \
            --arg send_date "$send_date_iso" \
            --arg gen_started "$gen_started" \
            --arg gen_finished "$gen_finished" \
            --argjson extra "$extra" \
            '[{
                send_date: $send_date,
                gen_started: ($gen_started | if . == "" then null else . end),
                gen_finished: ($gen_finished | if . == "" then null else . end),
                extra: $extra
            }]')
        
        # Build new message format
        new_message=$(jq -n -c \
            --arg name "$name" \
            --arg mes "$mes" \
            --arg send_date "$send_date_iso" \
            --argjson is_user "$is_user" \
            --argjson is_system "$is_system" \
            --arg force_avatar "$force_avatar" \
            --arg original_avatar "$original_avatar" \
            --argjson swipe_id "$swipe_id" \
            --argjson swipes "$swipes" \
            --argjson swipe_info "$swipe_info" \
            --argjson extra "$extra" \
            '{
                name: $name,
                mes: $mes,
                send_date: $send_date,
                is_user: $is_user,
                is_system: $is_system,
                force_avatar: ($force_avatar | if . == "" then null else . end),
                original_avatar: ($original_avatar | if . == "" then null else . end),
                swipe_id: $swipe_id,
                swipes: $swipes,
                swipe_info: $swipe_info,
                extra: $extra
            }')
        
        echo "$new_message" >> "$TEMP_FILE"
    fi
    
done < "$OLD_FILE"

# Move temp file to final location
mv "$TEMP_FILE" "$NEW_FILE"

echo ""
echo "Conversion complete!"
echo "  New file: $NEW_FILE"
echo "  Chat name: $chat_name"
echo "  Character: $CHARACTER_PNG"
echo ""
echo "You can now load this chat in NeoTavern."
