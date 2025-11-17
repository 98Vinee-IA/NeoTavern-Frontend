(function () {
  const { events, chat, ui } = SillyTavern.extensionAPI;

  function addStarButtonToMessages() {
    console.log('Adding star buttons to messages...');
    // Find all message elements in the DOM
    const messageElements = document.querySelectorAll('.message');

    messageElements.forEach((messageEl) => {
      // Find the button container within this message
      const buttonContainer = messageEl.querySelector('.message__buttons');
      if (!buttonContainer) return;

      // Check if our button already exists to prevent duplicates
      if (buttonContainer.querySelector('.my-star-button')) {
        return;
      }

      // Create the new button element
      const starButton = document.createElement('i');
      starButton.className = 'message__button fa-solid fa-star my-star-button';
      starButton.title = 'Star this message (from extension)';

      // Add a click handler
      starButton.onclick = () => {
        // Get the message index from the data attribute
        const messageIndex = parseInt(messageEl.getAttribute('data-message-index'), 10);

        // Get the full chat history
        const history = chat.getHistory();
        const message = history[messageIndex];

        if (message) {
          ui.showToast(`You starred a message from ${message.name}!`, 'success');
        } else {
          ui.showToast('Could not find message data.', 'error');
        }
      };

      // Add the button to the container
      buttonContainer.appendChild(starButton);
    });
  }

  // Handler for when a new chat is fully loaded
  function handleChatEntered(character, chatFile) {
    ui.showToast(`Entered chat with ${character.name}!`, 'info');
    // Run the main logic to add buttons to the newly loaded messages
    addStarButtonToMessages();
  }

  // Listen for the 'chat:entered' event to run setup on chat load.
  events.on('chat:entered', handleChatEntered);

  // Listen for the 'chat:updated' event to handle new messages (e.g., streaming).
  // events.on('chat:updated', addStarButtonToMessages);

  console.log('Message Buttons extension loaded and listening for chat events.');
})();
