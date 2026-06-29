/*jshint esversion: 6 */
// Calculate the N and M in linings analytically
//
// see following for more information:
// Authors: S.C. Möller & P.A. Vermeer
// Journal paper: Prediction of settlements and structural forces in 
//    linings due to tunnelling
// Presented in: Proceedings of the 5th International Conference of 
//    TC28 of the ISSMGE Amsterdam – The Netherlands June 15-17, 2005
// Link: http://www.issmge.org/uploads/publications/6/11/2005_085.pdf


function calc_n_m(gamma, H, R, t_c, E_c, nu, E) {
    // function to calculate the normal force and the moment
    // in linings
    // INPUTS:
    // gamma [number]: Unit weight of soil [kN/m³]
    // H     [number]: Depth of tunnel axis [m]
    // R     [number]: Radius of tunnel [m]
    // t_c   [number]: Thickness of lining [m]
    // E_c   [number]: Elasticity of lining [MPa]
    // nu    [number]: Poisson's ratio of soil [-]
    // E     [number]: Elasticity modulus of soil [kPa]
    //
    // OUTPUTS:
    // n [number]: Calculated normal force [kN/m]
    // m [number]: Calculated moment [kN/m/m]

    const Area = t_c;                                      // area (A) - width = 1 m
    const I = Math.pow(t_c, 3) / 12;                       // moment of inertia (I) - width = 1 m
    const alpha = E * Math.pow(R, 3) / (E_c * 1000 * I);   // Coeff. 1
    const beta = E * R / (E_c * 1000 * Area);              // Coeff. 2
    const k_0 = nu / (1 - nu);                             // Coeff. of lat. earth pressure [-]

    const n_1 = gamma * H * (1 + k_0) / 2 * R / (1 + beta / 
        (1 + nu) + beta / alpha);
    const A_n_2 = gamma * H * (1 - k_0) / 2 * R * (1 + alpha / 
        (12 * (1 + nu)) + beta / (4 * (1 + nu)));
    const B_n_2 = 1 + (3 - 2 * nu) * alpha / (12 * (3 - 4 * nu) * (1 + nu)) + (5 - 6 * nu) * beta / 
        (4 * (3 - 4 * nu) * (1 + nu)) + alpha * beta / (12 * (3 - 4 * nu) * Math.pow((1 + nu), 2));
    const n_2 = A_n_2 / B_n_2;

    const n = n_1 + n_2;  // Normal force

    const A_m = gamma * H * (1 - k_0) / 2 * Math.pow(R, 2) * (1 + beta / (2 * (1 + nu)));
    const B_m = 2 + (3 - 2 * nu) * alpha / (6 * (3 - 4 * nu) * (1 + nu)) + (5 - 6 * nu) * beta / 
        (4 * (3 - 4 * nu) * (1 + nu)) + alpha * beta / (6 * (3 - 4 * nu) * Math.pow((1 + nu), 2));

    const m = A_m / B_m;  // Moment

    const result = {
        normal_force : n,
        moment : m,
    };

    return result;
}

export default calc_n_m;
