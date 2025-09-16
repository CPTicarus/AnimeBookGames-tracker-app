// src/pages/LibraryPage.tsx
import { useState, useEffect } from 'react';
import api from '../api'; 

interface LibraryPageProps {
  token: string;
}

interface Media { id: number; title: string; }
interface UserMedia { id: number; media: Media; status: string; progress: number; }

function LibraryPage() {
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // The Authorization header is now added automatically!
        const response = await api.get('/api/user/list/');
        setUserMediaList(response.data);
      } catch (err) {
        console.error("Failed to fetch user list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <p>Loading your library...</p>;

  return (
    <div>
      <h1>Your Media List</h1>
      {userMediaList.length === 0 ? (
        <p>Your list is empty. Time to add some media!</p>
      ) : (
        <ul>
          {userMediaList.map((item) => (
            <li key={item.id}>
              {item.media.title} - Status: {item.status}, Progress: {item.progress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LibraryPage;