
function ImportPage() {
  const handleSync = () => {
    // This triggers the login popup. After login, we need to call a new sync endpoint.
    window.electronAPI.openLoginWindow();
    // TODO: After login success, call a new backend endpoint like /api/sync/anilist
    // We will build this endpoint in a future step.
    alert("After logging in, your list will be synced in the background. (Functionality to be built)");
  };

  return (
    <div>
      <h1>Import & Sync</h1>
      <p>Connect to a service to import your existing lists or to keep your local library in sync.</p>

      <button onClick={handleSync}>
        Connect and Sync with AniList
      </button>
    </div>
  );
}

export default ImportPage;