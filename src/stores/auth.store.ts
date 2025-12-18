import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface User {
  handle: string;
  name: string;
  avatar?: string;
  password?: boolean; // server returns boolean indicating if password is set
  created?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const needsLogin = ref(false);
  const isDiscreet = ref(false);
  const userList = ref<User[]>([]);
  const currentUser = ref<string | null>(null);

  async function fetchToken() {
    const response = await fetch('/csrf-token');
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    const tokenData = await response.json();
    token.value = tokenData.token;
  }

  async function fetchUserList() {
    if (!token.value) await fetchToken();

    const response = await fetch('/api/users/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token.value || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch user list');
    }

    if (response.status === 204) {
      isDiscreet.value = true;
      userList.value = [];
    } else {
      userList.value = await response.json();
    }
  }

  async function initialize() {
    await fetchToken();

    // Check if we need to login by hitting the login-check proxy
    // This proxies to the backend root. If backend requires auth, it redirects to /login
    try {
      const response = await fetch('/login-check', { method: 'GET' });
      if (response.redirected && response.url.includes('/login')) {
        needsLogin.value = true;
        await fetchUserList();
      } else {
        needsLogin.value = false;
      }
    } catch (error) {
      console.warn('Login check failed, assuming login required if API fails', error);
      // We don't force login here, we let API calls fail naturally if needed,
      // but usually this means backend is unreachable or proxy is wrong.
    }
  }

  async function login(handle: string, password?: string) {
    if (!token.value) await fetchToken();

    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token.value || '',
      },
      body: JSON.stringify({ handle, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await response.json();
    if (data.handle) {
      currentUser.value = data.handle;
      needsLogin.value = false;
    }
  }

  return {
    token,
    needsLogin,
    isDiscreet,
    userList,
    currentUser,
    fetchToken,
    initialize,
    login,
  };
});
