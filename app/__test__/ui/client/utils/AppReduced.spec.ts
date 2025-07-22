import { describe, it, expect, beforeEach } from "vitest";
import { AppReduced, type AppType } from "ui/client/utils/AppReduced";
import type { BkndAdminOptions } from "ui/client/BkndProvider";

// Import the normalizeAdminPath function for testing
// Note: This assumes the function is exported or we need to test it indirectly through public methods

describe("AppReduced", () => {
   let mockAppJson: AppType;
   let appReduced: AppReduced;

   beforeEach(() => {
      mockAppJson = {
         data: {
            entities: {},
            relations: {},
         },
         flows: {
            flows: {},
         },
         auth: {},
      } as AppType;
   });

   describe("getSettingsPath", () => {
      it("should return settings path with admin_basepath", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath();

         expect(result).toBe("~/admin/settings");
      });

      it("should return settings path with empty admin_basepath", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath();

         expect(result).toBe("~/settings");
      });

      it("should append additional path segments", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath(["user", "profile"]);

         expect(result).toBe("~/admin/settings/user/profile");
      });

      it("should normalize multiple slashes", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "//admin//",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath(["//user//"]);

         expect(result).toBe("~/admin/settings/user");
      });

      it("should handle admin_basepath without leading slash", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath();

         expect(result).toBe("~/admin/settings");
      });
   });

   describe("getAbsolutePath", () => {
      it("should return absolute path with admin_basepath", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath("dashboard");

         expect(result).toBe("~/admin/dashboard");
      });

      it("should return base path when no path provided", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath();

         expect(result).toBe("~/admin");
      });

      it("should normalize paths correctly", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "//admin//",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath("//dashboard//");

         expect(result).toBe("~/admin/dashboard");
      });
   });

   describe("options getter", () => {
      it("should return merged options with defaults", () => {
         const customOptions: BkndAdminOptions = {
            admin_basepath: "/custom-admin",
            logo_return_path: "/custom-home",
         };

         appReduced = new AppReduced(mockAppJson, customOptions);
         const options = appReduced.options;

         expect(options).toEqual({
            logo_return_path: "/custom-home",
            admin_basepath: "/custom-admin",
         });
      });

      it("should use default logo_return_path when not provided", () => {
         const customOptions: BkndAdminOptions = {
            admin_basepath: "/admin",
         };

         appReduced = new AppReduced(mockAppJson, customOptions);
         const options = appReduced.options;

         expect(options.logo_return_path).toBe("/");
         expect(options.admin_basepath).toBe("/admin");
      });
   });

   describe("path normalization behavior", () => {
      it("should normalize duplicate slashes in settings path", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath(["//nested//path//"]);

         expect(result).toBe("~/admin/settings/nested/path");
      });

      it("should handle root path normalization", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath();

         // The normalizeAdminPath function removes trailing slashes except for root "/"
         // When admin_basepath is "/", the result is "~/" which becomes "~" after normalization
         expect(result).toBe("~");
      });

      it("should preserve entity paths ending with slash", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath("entity/");

         expect(result).toBe("~/admin/entity/");
      });

      it("should remove trailing slashes from non-entity paths", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getAbsolutePath("dashboard/");

         expect(result).toBe("~/admin/dashboard");
      });
   });

   describe("edge cases", () => {
      it("should handle undefined admin_basepath", () => {
         const options: BkndAdminOptions = {
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath();

         // When admin_basepath is undefined, it defaults to empty string
         expect(result).toBe("~/settings");
      });

      it("should handle null path segments", () => {
         const options: BkndAdminOptions = {
            admin_basepath: "/admin",
            logo_return_path: "/",
         };

         appReduced = new AppReduced(mockAppJson, options);
         const result = appReduced.getSettingsPath(["", "valid", ""]);

         expect(result).toBe("~/admin/settings/valid");
      });
   });
});
