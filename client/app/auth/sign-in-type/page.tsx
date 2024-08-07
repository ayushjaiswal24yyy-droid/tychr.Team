"use client";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { userTypeSchema } from "@/lib/validator";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaBookOpenReader, FaGraduationCap } from "react-icons/fa6";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

const SignInType = () => {
  const [message, setMessage] = useState("");
  const router = useRouter();

  const form = useForm<z.infer<typeof userTypeSchema>>({
    defaultValues: {
      role: undefined,
    },
    resolver: zodResolver(userTypeSchema),
  });

  function handleRoleChange(values: z.infer<typeof userTypeSchema>) {
    if (!values.role) {
      setMessage("Please select a user type");
      return;
    }

    if (values.role === "tutor") {
      router.push("/auth/sign-up?role=tutor");
    } else {
      router.push("/auth/sign-up?role=student");
    }
  }

  return (
    <div className="flex gap-4 flex-col w-3/4">
      <span className="text-2xl font-semibold">Are you a?</span>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleRoleChange)}
          className="flex flex-col items-center gap-4 border rounded-md p-4"
        >
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <Button
                    {...field}
                    value="tutor"
                    variant={
                      form.getValues("role") === "tutor" ? "default" : "outline"
                    }
                    className="w-full flex gap-2 text-lg"
                    onClick={() => form.setValue("role", "tutor")}
                  >
                    <FaGraduationCap />
                    Tutor
                  </Button>
                </FormControl>
              </FormItem>
            )}
          />
          <span>OR</span>
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl>
                  <Button
                    {...field}
                    value="student"
                    variant={
                      form.getValues("role") === "student"
                        ? "default"
                        : "outline"
                    }
                    className="w-full flex gap-2 text-lg"
                    onClick={() => form.setValue("role", "student")}
                  >
                    <FaBookOpenReader />
                    Student
                  </Button>
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
      {message && <span className="text-red-500">{message}</span>}
    </div>
  );
};

export default SignInType;
