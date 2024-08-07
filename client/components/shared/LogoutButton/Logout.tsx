"use client";
import { deleteCookie, getCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
const Logout = () => {
  const router = useRouter();

  const jwt = getCookie("jwt");

  // if (!jwt) return null;

  const handleLogout = () => {
    deleteCookie("jwt", { path: "/" });

    toast.success("Logged out", {
      icon: "🚀",
    });

    router.push("/auth/sign-in");
  };

  return (
    <div onClick={handleLogout}>
      Logout
    </div>
  );
};

export default Logout;
