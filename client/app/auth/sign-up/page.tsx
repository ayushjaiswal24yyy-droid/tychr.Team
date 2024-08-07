"use client";
import SocialLogin from "@/components/shared/SocialLogin/SocialLogin";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signUpSchema } from "@/lib/validator";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FaUserGraduate } from "react-icons/fa6";
import { IoMail } from "react-icons/io5";
import { z } from "zod";
import axios from "axios";
import PasswordInput from "@/components/shared/Password/Password";
import { useState } from "react";
import Loader from "@/components/shared/FormLoader/Loader";

const STRAPI_URL = "http://localhost:1337";

const SignUp = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(false);

  const role = searchParams.get("role");

  const form = useForm<z.infer<typeof signUpSchema>>({
    defaultValues: {
      role: role as "tutor" | "student",
    },
    resolver: zodResolver(signUpSchema),
  });

  if (!role) {
    router.push("/auth/sign-in-type");
    return null;
  }

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    setLoading(true);
    const { confirmPassword, ...data } = values;
    try {
      const res = await axios.post(`${STRAPI_URL}/api/auth/local/register`, {
        username: data.email.toLowerCase(),
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        password: data.password,
        isTutor: data.role === "tutor",
      });

      const { uuid, user } = res.data;
      console.log(user);

      if (uuid) {
        toast.success("Check your mail for OTP", {
          icon: "🔐",
        });

        router.push("/auth/otp-verification?type=sign-up&uuid=" + uuid);
      }
    } catch (error) {
      console.log(error);
      toast.error("Registration failed", {
        icon: "🚫",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-3/4">
      <span className="text-2xl font-semibold">Sign Up</span>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col p-4 border rounded-md items-center gap-4 w-full"
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <div className="border flex flex-row gap-2 rounded-md items-center px-2">
                    <FaUserGraduate className="text-xl" />
                    <Input
                      {...field}
                      placeholder="Full Name"
                      className="text-base border-none focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <div className="border flex flex-row gap-2 rounded-md items-center px-2">
                    <IoMail className="text-xl" />
                    <Input
                      {...field}
                      placeholder="Email"
                      className="text-base border-none focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <PasswordInput {...field} placeholder="Confirm Password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Sign Up</Button>
        </form>
      </Form>
      <div>
        Already have an account?{" "}
        <Link
          href={"/auth/sign-in"}
          className="font-medium px-1 hover:underline"
        >
          Sign In
        </Link>
      </div>
      <SocialLogin />
      {loading && <Loader />}
    </div>
  );
};

export default SignUp;
