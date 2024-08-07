"use client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { phoneAuthSchema } from "@/lib/validator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { IoPhonePortraitOutline } from "react-icons/io5";
import { z } from "zod";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { setCookie } from "cookies-next";

const STRAPI_URL = "http://localhost:1337";

const PhoneAuth = () => {
  const searchParams = useSearchParams();

  const router = useRouter();

  const role = searchParams.get("role");

  const form = useForm<z.infer<typeof phoneAuthSchema>>({
    defaultValues: {
      phone: "",
      role: role!,
    },
    resolver: zodResolver(phoneAuthSchema),
  });

  if (!role) {
    toast.error("Role not found");
    router.push("/auth/sign-in-type");
    return null;
  }

  async function onSubmit(values: z.infer<typeof phoneAuthSchema>) {
    try {
      const res = await axios.post(
        `${STRAPI_URL}/api/phone-auth/authenticate`,
        {
          phone: values.phone,
          role: values.role === "tutor",
        }
      );

      console.log(res);

      const { user, jwt } = res.data;

      if (user) {
        setCookie("jwt", jwt);
        toast.success("Check your messages for OTP!", {
          icon: "🎉",
        });
        router.push("/auth/otp-verification?type=phone&uuid=" + user.uuid);
      }
    } catch (error) {
      console.log(error);
      toast.error("Registration failed", {
        icon: "🚫",
      });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-3/4">
      <span className="text-2xl font-semibold">Phone Authentication</span>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col p-4 border rounded-md items-center gap-4 w-full"
        >
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <div className="border flex flex-row gap-2 rounded-md items-center px-2">
                    <IoPhonePortraitOutline className="text-xl" />
                    <Input
                      {...field}
                      placeholder="Mobile Number"
                      className="text-base border-none focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Enter your mobile number for <u>OTP</u>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Send OTP</Button>
        </form>
      </Form>
    </div>
  );
};

export default PhoneAuth;
