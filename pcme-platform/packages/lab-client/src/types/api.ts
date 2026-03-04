import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  timeout: 300_000, // 5min for large uploads
});
