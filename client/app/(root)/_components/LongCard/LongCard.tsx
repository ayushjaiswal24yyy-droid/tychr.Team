import { Course } from "@/types";
import Image from "next/image";

const LongCard = ({ course }: { course: Course }) => {
  return (
    <div className="flex gap-4 items-center border-2 rounded-md p-2">
      <div>
        <Image
          src={course.image}
          alt={course.name}
          width={400}
          height={400}
          className="w-52 rounded-md"
        />
      </div>
      <div className="flex gap-2 flex-col w-full">
        <div className="flex justify-between">
          <p className="font-semibold text-lg">{course.name}</p>
          <p className="text-sm">
            {" "}
            {course.date} | {course.duration}
          </p>
        </div>
        <p className="text-xl font-semibold">{course.prof}</p>
        <div className="text-sm text-right">{course.lectures} Lectures</div>
      </div>
    </div>
  );
};

export default LongCard;
