import { Navigate } from "react-router-dom";

// Redirect to trip settings as the default settings page
const Settings = () => {
  return <Navigate to="/settings/trips" replace />;
};

export default Settings;
