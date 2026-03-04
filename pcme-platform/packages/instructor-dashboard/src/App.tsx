import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionList } from "./routes/SessionList";
import { SessionReview } from "./routes/SessionReview";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/review/:sessionId" element={<SessionReview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
