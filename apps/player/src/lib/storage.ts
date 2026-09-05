// Browser adapter; native resolves storage.native.ts instead.
const storage = {
  async getItem(key: string): Promise<string | null> {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  },
};
export default storage;
