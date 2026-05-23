import Silian_React from 'react';
import { RouterProvider as Silian_RouterProvider } from 'react-router-dom';
import { router as Silian_router } from './router';
import './lib/i18n';

function Silian_App() {
  return <Silian_RouterProvider router={Silian_router} />;
}

export default Silian_App;

