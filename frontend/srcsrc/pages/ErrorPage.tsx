
interface ErrorPageProps {
  error: Error;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error }) => {
  console.error(error);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Oops!</h1>
        <p className="mb-4">Sorry, an unexpected error has occurred.</p>
        {error?.message && (
          <p className="text-gray-500">
            <i>{error.message}</i>
          </p>
        )}
      </div>
    </div>
  );
};

export default ErrorPage;
