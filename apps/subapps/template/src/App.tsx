import { useEffect } from 'react';
import { writeLog } from './api';
import UserBoard from './components/UserBoard';

export default function App() {
  useEffect(() => {
    void writeLog({
      kind: 'page',
      path: window.location.pathname,
      title: document.title,
    }).catch(() => undefined);
  }, []);
  return <UserBoard />;
}
