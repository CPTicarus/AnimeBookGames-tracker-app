import { useState, useEffect } from 'react';
import api from '../api'; 

interface Media {
  id: number;
  primary_title: string;   // Formerly 'title'
  secondary_title: string | null; // Formerly 'english_title'
}
interface UserMedia { id: number; media: Media; status: string; progress: number; }

function LibraryPage() {
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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
        <p>Your list is empty. Go to the Import page to sync your library!</p>
      ) : (
        <ul>
          {/* --- UPDATE THE RENDERED LIST ITEM --- */}
          {userMediaList.map((item) => (
            <li key={item.id} className="media-item">
              <span className={`status-dot status-dot-${item.status}`}></span>
              <div className="title-block">
                {/* Use secondary_title if it exists, otherwise use primary_title */}
                <span className="title-english">{item.media.secondary_title || item.media.primary_title}</span>
                {/* Only show the romaji title if an english title exists */}
                <span className="title-romaji">{item.media.secondary_title ? item.media.primary_title : ''}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LibraryPage;