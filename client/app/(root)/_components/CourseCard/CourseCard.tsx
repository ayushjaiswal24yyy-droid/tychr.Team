import { Course } from "@/types";
import Image from "next/image";

const CourseCard = ({ course }: { course: Course }) => {
  return (
    <div className="flex flex-col gap-2 p-4 items-center border-2 rounded-md w-[350px] h-[300px] overflow-hidden flex-shrink-0">
      <Image
        src={course.image}
        alt={course.name}
        width={400}
        height={400}
        className="w-52 rounded-md"
      />
      <p className="text-base font-semibold truncate">{course.name}</p>
      <div className="flex justify-between w-full">
        <p className="text-sm">{course.lectures} Lectures</p>
        <p className="text-sm">{course.duration}</p>
      </div>
      <p className="text-sm line-clamp-3">{course.description}</p>
    </div>
  );
};

export default CourseCard;
