import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import LiveRecognition from './pages/LiveRecognition';
import VideoRecognition from './pages/VideoRecognition';
import Dictionary from './pages/Dictionary';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="live" element={<LiveRecognition />} />
        <Route path="upload" element={<VideoRecognition />} />
        <Route path="dictionary" element={<Dictionary />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
