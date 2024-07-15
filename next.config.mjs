/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push("esbuild")
    config.externals.push("pino-pretty", "lokijs", "encoding")

    return config
  },
}

export default nextConfig
