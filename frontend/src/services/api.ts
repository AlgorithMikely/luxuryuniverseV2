import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Use a relative URL for the proxy
});

let store: any;

export const injectStore = (_store: any) => {
  store = _store;
};

api.interceptors.request.use(
  (config) => {
    if (store) {
      const token = store.getState().token;
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (store) {
        const { logout } = store.getState();
        logout();
      }
      // Optionally, redirect to login page
      // if (window.location.pathname !== '/login') {
      //   window.location.href = '/login';
      // }
    }
    return Promise.reject(error);
  }
);

export default api;
