import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TransitionProvider } from "@/contexts/TransitionContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import TransitionsList from "./pages/TransitionsList";
import NewTransition from "./pages/NewTransition";
import TransitionDetail from "./pages/TransitionDetail";
import WeeklyUpdateForm from "./pages/WeeklyUpdateForm";
import CoachingLogForm from "./pages/CoachingLogForm";
import DataImport from "./pages/DataImport";
import ModelCalibration from "./pages/ModelCalibration";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TransitionProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transitions" element={<TransitionsList />} />
              <Route path="/transitions/new" element={<NewTransition />} />
              <Route path="/transitions/:id" element={<TransitionDetail />} />
              <Route path="/transitions/:id/update" element={<WeeklyUpdateForm />} />
              <Route path="/transitions/:id/coaching/new" element={<CoachingLogForm />} />
              <Route path="/import" element={<DataImport />} />
              <Route path="/calibration" element={<ModelCalibration />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TransitionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
