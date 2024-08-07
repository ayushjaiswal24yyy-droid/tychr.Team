import Search from "../Search/Search";
import NavIcons from "../NavIcons/NavIcons";
import Image from "next/image";

const Navbar = () => {
  return (
    <div className="flex items-center justify-between p-4 shadow-lg">
      <Image src={"/tychr.png"} alt="logo" width={1200} height={1200} className="h-11 w-28"/>
      <Search />
      <NavIcons />
    </div>
  );
};

export default Navbar;
