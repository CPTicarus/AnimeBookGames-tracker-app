import { useState, useEffect } from 'react';
import axios from 'axios';

// Define props to accept the token from the App component
interface LibraryPageProps {
  token: string;
}

interface Media { id: number; title: string; cover_image_url: string; }
interface UserMedia { id: number; media: Media; status: string; progress: number; score: number | null; }

function LibraryPage({ token }: LibraryPageProps) {
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      setLoading(true);
      try {
        const response = await axios.get('/api/user/list/', {
          headers: { 'Authorization': `Token ${token}` }
        });
        setUserMediaList(response.data);
      } catch (err) {
        console.error("Failed to fetch user list", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]); // This effect runs when the component loads and if the token changes

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