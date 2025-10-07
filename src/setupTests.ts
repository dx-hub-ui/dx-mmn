import "@testing-library/jest-dom/vitest";

window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView ?? (() => {});
