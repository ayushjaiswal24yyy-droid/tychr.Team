import Image from "next/image";

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-screen relative bg-bgBooks bg-contain md:bg-contain overflow-hidden flex items-center flex-col md:flex-row">
      <div className="bg-[#E0FCFC] opacity-85 rounded-full md:h-[45rem] p-64 md:p-[30rem] md:-left-56 -top-56 md:-top-28 h-48 absolute"></div>
      <div className="flex h-1/2 items-center">
        <Image
          src={"/tychr.png"}
          alt="logo"
          width={1200}
          quality={100}
          height={1200}
          className="object-contain md:h-36 h-20 z-10"
        />
      </div>
      <div className="flex flex-col gap-8 items-center justify-center h-screen w-full bg-white">
        <h2 className="text-6xl font-bold md:pt-8 flex z-10">Welcome!</h2>
        <div className="flex items-center justify-center w-full">{children}</div>
      </div>
    </div>
  );
};

export default layout;

// BG - opacity reduce -- not possible, create an image with reduced opacity
// color checkout -- it's same as figma
