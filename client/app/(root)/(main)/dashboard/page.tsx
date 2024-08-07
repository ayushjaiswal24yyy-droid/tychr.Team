import { Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import TopBar from "../../_components/TopBar/TopBar";
import LongCard from "../../_components/LongCard/LongCard";
import CourseCard from "../../_components/CourseCard/CourseCard";
import { courses } from "@/constants/data";

const Dashboard = () => {
  return (
    <div>
      <TopBar />
      <div className="flex flex-col justify-between p-4 gap-4">
        <p className="text-2xl font-bold">Quick Actions</p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-accent p-4 rounded-md">
            <h2 className="text-2xl font-bold mb-4">Enrolled Courses</h2>
            <div className="relative">
              <div className="flex flex-col gap-4 h-64 px-2 overflow-y-auto">
                {courses.slice(0, 6).map((course) => (
                  <LongCard course={course} key={course.id} />
                ))}
              </div>
              <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-accent to-transparent pointer-events-none"></div>
            </div>
            <Button variant="default" className="w-full">
              Manage Courses
            </Button>
          </div>
          <div className="flex-1 bg-accent p-4 rounded-md">
            <div>
              <h2 className="text-2xl font-bold mb-2">Best Courses</h2>
              {courses.slice(0, 1).map((course) => (
                <LongCard course={course} key={course.id} />
              ))}
            </div>
            <h2 className="text-2xl font-bold my-2">
              50% converted from 4 to 7
            </h2>
            {courses.slice(0, 1).map((course) => (
              <LongCard course={course} key={course.id} />
            ))}
          </div>
          {/* Add functionality */}
          <div className="bg-accent p-4 rounded-md w-[300px]">
            <h2 className="text-2xl font-bold mb-4">Filters</h2>
            <Separator />
            <div className="flex flex-col gap-2 my-2">
              <p className="p-2 hover:bg-card rounded-md cursor-pointer">
                Upload Date
              </p>
              <p className="p-2 hover:bg-card rounded-md cursor-pointer">
                Duration
              </p>
              <p className="p-2 hover:bg-card rounded-md cursor-pointer">
                Rating
              </p>
              <p className="p-2 hover:bg-card rounded-md cursor-pointer">
                Price
              </p>
              <p className="p-2 hover:bg-card rounded-md cursor-pointer">
                Lectures
              </p>
            </div>
          </div>
        </div>
        <div className="bg-accent p-4 rounded-md">
          <h2 className="text-2xl font-bold mb-4">Our Courses</h2>
          <div className="relative">
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 top-0 w-20 bg-gradient-to-l from-accent to-transparent pointer-events-none"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
