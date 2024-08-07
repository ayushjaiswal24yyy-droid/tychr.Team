import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import { IoBookSharp, IoHomeSharp, IoSettingsSharp } from "react-icons/io5";
import { FaGifts, FaVideo } from "react-icons/fa6";
import { FaChalkboardTeacher, FaPhotoVideo } from "react-icons/fa";

const links = [
  {
    name: "Home",
    href: "/",
    icon: IoHomeSharp,
  },
  {
    name: "Freebies",
    href: "/freebies",
    icon: FaGifts,
  },
  {
    name: "Syllabus",
    href: "/syllabus",
    icon: IoBookSharp,
  },
  {
    name: "Live",
    href: "/live",
    icon: FaVideo,
  },
  {
    name: "Recording",
    href: "/recording",
    icon: FaPhotoVideo,
  },
  {
    name: "Educators",
    href: "/educators",
    icon: FaChalkboardTeacher,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: IoSettingsSharp,
  },
];

const DrawerMenu = () => {
  return (
    <Sheet>
      <SheetTrigger className="rounded-full p-1.5 hover:bg-accent hover:text-accent-foreground">
        <Image src={"/menu.svg"} width={20} height={20} alt="menu" />
      </SheetTrigger>
      <SheetContent side={"left"} className="md:w-1/3 w-1/2">
        <SheetHeader className="flex flex-col gap-2 justify-center w-full items-center">
          <SheetTitle className="flex items-center flex-col gap-2">
            <Avatar className="!w-28 !h-28 shadow-lg">
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback>MH</AvatarFallback>
            </Avatar>
          </SheetTitle>
          <SheetDescription className="text-center">
            <p className="text-2xl font-bold">Mori Han</p>
            <p className="text-base font-light">Tutor</p>
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex flex-col gap-2 mt-2">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-2 p-4 rounded-lg hover:bg-accent hover:text-accent-foreground"
            >
              <link.icon />
              <p>{link.name}</p>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DrawerMenu;
