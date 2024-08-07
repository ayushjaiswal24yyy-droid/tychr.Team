import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logout from "@/components/shared/LogoutButton/Logout";
import Link from "next/link";

const AvatarSection = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-visible:ring-0 focus-visible:outline-none">
        <Avatar>
          <AvatarImage src="/avatar.jpg" />
          <AvatarFallback>MH</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Mori Han</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href={"/profile"}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href={"/my-courses"}>Courses</Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Logout />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AvatarSection;
