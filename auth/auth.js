const api = "https://api-class-o1lo.onrender.com/api/dungvh";
const formRegister = document.getElementById("register-form");
const formLogin = document.getElementById("login-form");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(email, password, age, phone) {
  try {
    if (!email.trim().length) {
      alert("Không được dể trống email");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      alert("Email không hợp lệ");
      return;
    }
    if (password.trim().length <= 6) {
      alert("Không được dể trống password và phải trên 6 ký tự");
      return;
    }
    if (!phone.trim().length) {
      alert("Không được dể trống phones");
      return;
    }
    if (age <= 6) {
      alert("Người dùng không được bé hơn 6 tuổi");
      return;
    }
    await axios.post(`${api}/auth/register`, {
      email,
      password,
      age,
      phone,
    });
    alert("Đăng ký thành công");
    window.location.href = "./login.html";
  } catch (error) {
    alert(error.response.data.message || error.message);
  }
}

async function login(email, password) {
  try {
    const { data } = await axios.post(`${api}/auth/login`, {
      email,
      password,
    });
    const token = data?.data?.accessToken || data?.accessToken;
    if (!token) throw new Error("Login ok nhưng không nhận được accessToken");

    localStorage.setItem("accessToken", token);
    if (data?.data) localStorage.setItem("user", JSON.stringify(data.data));

    alert("Đăng nhập thành công");
    window.location.replace("/index.html");
  } catch (error) {
    alert(error.message);
  }
}

if (formRegister) {
  formRegister.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(formRegister);
    const data = Object.fromEntries(formData.entries());
    register(data.email, data.password, data.age, data.phone);
  });
}

if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(formLogin);
    const data = Object.fromEntries(formData.entries());
    login(data.email, data.password);
  });
}
