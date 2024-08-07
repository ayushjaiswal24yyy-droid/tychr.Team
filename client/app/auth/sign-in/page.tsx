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
import { signInSchema } from "@/lib/validator";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { IoMail } from "react-icons/io5";
import { z } from "zod";
import axios from "axios";
import PasswordInput from "@/components/shared/Password/Password";
import { useState } from "react";
import Loader from "@/components/shared/FormLoader/Loader";

const STRAPI_URL = "http://localhost:1337";

const SignIn = () => {
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(false);

  const form = useForm<z.infer<typeof signInSchema>>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(signInSchema),
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setLoading(true);
    try {
      const res = await axios.post(`${STRAPI_URL}/api/auth/local/`, {
        identifier: values.email.toLowerCase(),
        password: values.password,
      });

      const { uuid } = res.data;

      if (uuid) {
        toast.success("Check your mail for OTP", {
          icon: "🔐",
        });

        router.push("/auth/otp-verification?type=sign-in&uuid=" + uuid);
      }
    } catch (error) {
      console.log(error);
      toast.error("Authentication failed", {
        icon: "🚫",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-3/4">
      <span className="text-2xl font-semibold">Sign In</span>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col p-4 border rounded-md items-center gap-4 w-full"
        >
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
          <Button type="submit">Sign In</Button>
        </form>
      </Form>

      <div className="flex flex-col items-center gap-2">
        <div>
          <Link
            href={"/auth/reset-password"}
            className="font-medium px-1 hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        <div>
          Don&apos;t have an account?{" "}
          <Link
            href={"/auth/sign-in-type"}
            className="font-medium px-1 hover:underline"
          >
            Sign Up
          </Link>
        </div>
      </div>
      <SocialLogin />
      {loading && <Loader />}
    </div>
  );
};

export default SignIn;
