function isLogEnabled() {
  if (typeof window !== "undefined" && "__APP_LOG__" in window) {
    return Boolean((window as any).__APP_LOG__);
  }
  return import.meta.env.VITE_APP_DEBUG === "true";
}

function createLogger(topic = "Testing") {
  return {
    topic,

    setTopic(newTopic: string) {
      this.topic = newTopic || "Testing";
    },

    log(desc: string, ...args: any[]) {
      if (!isLogEnabled()) return;
      console.log(`[${this.topic}] ${desc}:`, ...args);
    },
    info(desc: string, ...args: any[]) {
      if (!isLogEnabled()) return;
      console.info(`[${this.topic}] ${desc}:`, ...args);
    },
    warn(desc: string, ...args: any[]) {
      if (!isLogEnabled()) return;
      console.warn(`[${this.topic}] ${desc}:`, ...args);
    },
    error(desc: string, ...args: any[]) {
      if (!isLogEnabled()) return;
      console.error(`[${this.topic}] ${desc}:`, ...args);
    },
  };
}

export const logger = {
  /** 工厂方法，创建带独立 topic 的 logger 实例 */
  create: (topic?: string) => createLogger(topic),

  /** 全局运行时开关控制 */
  enable() {
    (window as any).__APP_LOG__ = true;
    console.info("[logger] enabled at runtime");
  },
  disable() {
    (window as any).__APP_LOG__ = false;
    console.info("[logger] disabled at runtime");
  },
  status() {
    console.info("[logger] current status:", isLogEnabled());
  },
};
