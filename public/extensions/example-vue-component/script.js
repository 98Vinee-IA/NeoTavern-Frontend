(function () {
  console.log('Loading Example Vue Component extension...');

  // Ensure the API is ready
  if (!window.SillyTavern || !window.SillyTavern.extensionAPI || !window.SillyTavern.vue) {
    console.error('SillyTavern API or Vue not available. This extension cannot run.');
    return;
  }
  const { createApp, ref } = window.SillyTavern.vue;
  const { chat, ui, settings } = window.SillyTavern.extensionAPI;

  // Define the Vue component
  const MyComponent = {
    setup() {
      const messageToSend = ref('');
      const someSetting = ref(settings.get('chat.sendOnEnter'));

      function sendMessage() {
        if (!messageToSend.value.trim()) {
          ui.showToast('Please enter a message.', 'warning');
          return;
        }
        chat.sendMessage(messageToSend.value);
        messageToSend.value = '';
      }

      function showToast() {
        ui.showToast('Hello from the Vue component!', 'info');
      }

      return {
        messageToSend,
        someSetting,
        sendMessage,
        showToast,
      };
    },
    template: `
      <div class="example-vue-component extension_container">
        <div class="inline-drawer-header"><b>Vue Component Example</b></div>
        <div class="inline-drawer-content">
            <p>You can use modern tools like Vue to build your extension's UI. This gives you access to the full reactivity and component system of Vue.</p>
            <p>Current "Send on Enter" setting: <code>{{ someSetting }}</code></p>
            <div class="form-group">
                <label>Send a message to the chat:</label>
                <div class="input-with-button">
                  <input type="text" class="text-pole" v-model="messageToSend" @keydown.enter="sendMessage" placeholder="Type here..." />
                  <button class="menu-button" @click="sendMessage">Send</button>
                </div>
            </div>
            <button class="menu-button" @click="showToast">Show a Toast</button>
        </div>
      </div>
    `,
  };

  // Find the container and mount the component
  const interval = setInterval(() => {
    const container = document.getElementById('example-vue-component_container');
    if (container) {
      clearInterval(interval);

      // Prevent re-mounting
      if (container.childElementCount > 0) return;

      createApp(MyComponent).mount(container);
      console.log('Example Vue Component extension loaded and mounted.');
    }
  }, 100);
})();
