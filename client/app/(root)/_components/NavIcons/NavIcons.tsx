import { Button } from "@/components/ui/button";
import { IoSettingsSharp } from "react-icons/io5";
import AvatarSection from "../AvatarSection/AvatarSection";

const NavIcons = () => {
  return (
    <div className="flex items-center gap-4">
      <Button variant={"ghost"} size={"icon"} className="rounded-full">
        <IoSettingsSharp className="text-xl" />
      </Button>
      <AvatarSection />
    </div>
  );
};

export default NavIcons;
