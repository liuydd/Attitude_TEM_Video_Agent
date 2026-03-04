import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ExperimentSetup } from "./routes/ExperimentSetup";
import { ExperimentSession } from "./routes/ExperimentSession";
import { Questionnaire } from "./routes/Questionnaire";
import { SessionComplete } from "./routes/SessionComplete";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExperimentSetup />} />
        <Route path="/session" element={<ExperimentSession />} />
        <Route path="/questionnaire" element={<Questionnaire />} />
        <Route path="/complete" element={<SessionComplete />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
