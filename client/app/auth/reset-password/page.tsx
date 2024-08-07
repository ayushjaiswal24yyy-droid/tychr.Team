"use client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/lib/validator";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { IoMail } from "react-icons/io5";
import { z } from "zod";
import axios from "axios";

const STRAPI_URL = "http://localhost:1337";

const ResetPassword = () => {
  const router = useRouter();

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    try {
      const res = await axios.post(`${STRAPI_URL}/api/auth/forgot-password`, {
        email: values.email.toLowerCase(),
      });
      console.log(res);
      if (res.status === 200) {
        toast.success("Password reset link sent!", {
          icon: "✉️",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to send reset link", {
        icon: "🚫",
      });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-3/4">
      <span className="text-2xl font-semibold">Reset Password</span>
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
          <Button type="submit">Send Reset Link</Button>
        </form>
      </Form>
      <div>
        Remember your password?{" "}
        <Link
          href={"/auth/sign-in"}
          className="font-medium px-1 hover:underline"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
