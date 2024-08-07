"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { searchBar } from "@/lib/validator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { IoSearchOutline } from "react-icons/io5";
import { z } from "zod";

const Search = () => {
  const form = useForm<z.infer<typeof searchBar>>({
    defaultValues: {
      query: "",
    },
    resolver: zodResolver(searchBar),
  });

  const router = useRouter();

  const onSubmit = (data: z.infer<typeof searchBar>) => {
    if (data.query.length === 0) return;
    if (data.query.length < 3) {
      return toast.error("Please enter at least 3 characters", {
        icon: "🚫",
      });
    }

    router.push(`/courses?query=${data.query}`);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-center w-1/2 justify-between rounded-full border px-1"
      >
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Input
                  {...field}
                  placeholder="Search for latest courses"
                  className="w-full border-none rounded-full focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          variant="ghost"
          size="icon"
          type="submit"
          className="rounded-full"
        >
          <IoSearchOutline />
        </Button>
      </form>
    </Form>
  );
};

export default Search;
