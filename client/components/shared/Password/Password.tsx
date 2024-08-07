import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FaAsterisk } from "react-icons/fa6";

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

const PasswordInput = ({
  value,
  onChange,
  placeholder = "Password",
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="border flex flex-row gap-2 rounded-md items-center px-2">
      <FaAsterisk />
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="text-base border-none focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0"
      />
      <button type="button" onClick={toggleShowPassword}>
        {showPassword ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  );
};

export default PasswordInput;
