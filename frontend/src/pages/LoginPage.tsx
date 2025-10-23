const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Universe Bot</h1>
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          Login with Discord
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
