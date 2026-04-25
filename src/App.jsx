import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import InventoryAppContent from './components/inventory/InventoryAppContent';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function getDefaultPartyPath() {
  const lastVisited = localStorage.getItem('lastVisitedParty');
  const partyId = lastVisited || crypto.randomUUID();
  return `/parties/${partyId}`;
}

export default function App() {
  return (
    <Router>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route
            path="/parties/:partyId"
            element={
              <InventoryAppContent
                firebaseConfig={null}
                appId={firebaseConfig.appId}
                db={db}
                auth={auth}
              />
            }
          />
          <Route path="*" element={<Navigate to={getDefaultPartyPath()} replace />} />
        </Routes>
      </main>
    </Router>
  );
}
