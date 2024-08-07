const ModuleError = ({ message }: { message: string }) => {
  return (
    <div>
      <p className="text-red-500">{message}</p>
    </div>
  );
};

export default ModuleError;
