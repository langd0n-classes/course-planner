// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type { CourseDto } from "@/lib/redesign-contract";
import CourseIndexPage from "./CourseIndexPage";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("CourseIndexPage", () => {
  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  it("navigates to the created course workspace using the returned course id", async () => {
    const createdCourse: CourseDto = {
      id: "course-created-42",
      instructorId: "instructor-1",
      shortId: "CP-142",
      title: "Created Course",
      titleIsPlaceholder: false,
      number: "CP 142",
      numberIsPlaceholder: false,
      description: null,
      archivedAt: null,
    };

    const listCourses = vi.fn(async () => []);
    const createCourse = vi.fn(async () => createdCourse);

    setMockBackend({
      listCourses,
      createCourse,
    });

    render(<CourseIndexPage />);

    await screen.findByText("No courses yet.");

    fireEvent.click(screen.getByRole("button", { name: "New course" }));
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/courses/course-created-42"));
    expect(createCourse).toHaveBeenCalledTimes(1);
    expect(listCourses).toHaveBeenCalledTimes(1);
  });
});
