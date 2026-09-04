/// <reference types="vite/client" />

interface HIDDevice {
  vendorId: number;
  productName?: string;
}

interface Navigator {
  readonly hid: HID;
}

interface HID {
  addEventListener(
    type: "connect" | "disconnect",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "connect" | "disconnect",
    listener: (event: Event) => void,
  ): void;
}
