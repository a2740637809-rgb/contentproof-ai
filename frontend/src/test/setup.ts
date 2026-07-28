import "@testing-library/jest-dom/vitest";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  disconnect() {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
  }
  takeRecords() { return []; }
  unobserve() {}
  constructor(private callback: IntersectionObserverCallback) {}
}

globalThis.IntersectionObserver = TestIntersectionObserver;
