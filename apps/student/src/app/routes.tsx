import { createBrowserRouter } from "react-router-dom";
import AppShell from "../app/AppShell";
import Home from "../pages/Home";
import Wardrobe from "../pages/Wardrobe";
import Play from "../pages/Play"; // 전투 씬/페이지

export const router = createBrowserRouter([
  {
    element: <AppShell />,              // ✅ 헤더가 모든 하위 라우트에서 뜸
    children: [
      { index: true, element: <Home /> },
      { path: "/wardrobe", element: <Wardrobe /> },
      { path: "/play", element: <Play /> },  // ✅ 전투 씬도 헤더 포함
    ],
  },
]);
