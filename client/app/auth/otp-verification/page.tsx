"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { setCookie } from "cookies-next";
import axios from "axios";
import { useState } from "react";
import Loader from "@/components/shared/FormLoader/Loader";

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export default function Verification() {
  const [loading, setLoading] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const type = searchParams.get("type");
  const uuid = searchParams.get("uuid");

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  if (!searchParams.get("type")) {
    return router.push("/auth/sign-in-type");
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    const STRAPI_URL = "http://localhost:1337";
    try {
      const res = await axios.post(`${STRAPI_URL}/api/auth/verify-otp`, {
        otp: data.pin,
        uuid,
      });

      const { jwt } = res.data;

      if (res) {
        toast.success(`OTP verified successfully`, {
          icon: "🔥",
        });
        setCookie("jwt", jwt);
        router.push("/dashboard");
      } else {
        toast.error(`OTP verification failed`, {
          icon: "🚫",
        });
      }
    } catch (error) {
      console.log(error);

      toast.error(`OTP verification failed`, {
        icon: "🚫",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-2/3 space-y-6"
        >
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>One-Time Password</FormLabel>
                <FormControl>
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormDescription>
                  Please enter the one-time password sent to your phone or mail.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
      {loading && <Loader />}
    </div>
  );
}
