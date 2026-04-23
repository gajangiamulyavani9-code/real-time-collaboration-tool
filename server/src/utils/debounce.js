/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} - The debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function - ensures the function is called at most once per wait period
 * 
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle
 * @returns {Function} - The throttled function
 */
export const throttle = (func, wait) => {
  let lastTime = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    
    if (now - lastTime >= wait) {
      func(...args);
      lastTime = now;
    }
  };
};

/**
 * Async debounce - handles async functions with proper error handling
 * 
 * @param {Function} func - The async function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} - The debounced async function
 */
export const debounceAsync = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    return new Promise((resolve, reject) => {
      const later = async () => {
        clearTimeout(timeout);
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    });
  };
};
