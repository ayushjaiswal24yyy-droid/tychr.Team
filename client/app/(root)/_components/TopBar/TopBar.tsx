import Link from "next/link";
import DrawerMenu from "../DrawerMenu/DrawerMenu";

const TopBar = () => {
  return (
    <div className="w-full flex px-4 justify-between gap-4 items-center border-b py-2">
      <div className="flex items-center">
        <DrawerMenu />
      </div>
      <div className="flex gap-4 items-center text-sm flex-wrap">
        <Link href={"/dashboard"} className="hover:underline">
          Dashboard
        </Link>
        <Link href={"/pyp"} className="hover:underline">
          PYP
        </Link>
        <Link href={"/myp"} className="hover:underline">
          MYP
        </Link>
        <Link href={"/dp"} className="hover:underline">
          DP
        </Link>
        <Link href={"/consulting"} className="hover:underline">
          College Consulting
        </Link>
        <Link href={"/igcse"} className="hover:underline">
          IGCSE
        </Link>
        <Link href={"/levels"} className="hover:underline">
          AS/A Levels
        </Link>
        <Link href={"/sat"} className="hover:underline">
          SAT/ACT/AP
        </Link>
      </div>
    </div>
  );
};

export default TopBar;
