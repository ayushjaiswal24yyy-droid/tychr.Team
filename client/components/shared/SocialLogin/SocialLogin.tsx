"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FaGoogle } from "react-icons/fa6";
import { IoCall } from "react-icons/io5";

const SocialLogin = () => {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");

  return (
    <div className="flex gap-4">
      <Link href={"/auth/phone-sign-in?role=" + role}>
        <Button variant="outline" size="icon" className="rounded-full text-xl">
          <IoCall />
        </Button>
      </Link>
      <Button variant="outline" size="icon" className="rounded-full text-xl">
        <FaGoogle />
      </Button>
    </div>
  );
};

export default SocialLogin;
