/** מטמון דפים ריק לבדיקות E2E בלבד (נטען מ-next.config.js כש-E2E=1): כל בקשה מרנדרת מחדש. */
module.exports = class NoCacheHandler {
  async get() {
    return null;
  }
  async set() {}
  async revalidateTag() {}
  resetRequestCache() {}
};
