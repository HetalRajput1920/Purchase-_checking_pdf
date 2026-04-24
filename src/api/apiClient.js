/**
 * Base API Client for New Purchase Project
 */

const API_BASE_URL = 'http://192.168.1.110:3007'; // Replace with actual API URL

export const apiClient = {
  get: async (endpoint) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error('API GET Error:', error);
      throw error;
    }
  },

  post: async (endpoint, data) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error('API POST Error:', error);
      throw error;
    }
  },

  upload: async (endpoint, formData) => {
    try {
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('File upload failed');
      return await response.json();
    } catch (error) {
      console.error('API Upload Error:', error);
      throw error;
    }
  },
};
